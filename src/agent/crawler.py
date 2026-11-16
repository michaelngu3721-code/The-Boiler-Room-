import logging
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

LOGGER = logging.getLogger(__name__)

ALLOWED_WEB_HOSTS = {"psi.nasa.gov", "www.nasa.gov", "spinoff.nasa.gov", "sma.nasa.gov"}
MAX_CRAWL_PAGES = 10
MAX_CRAWL_DEPTH = 1
MAX_PAGE_TEXT_CHARS = 2_000
MAX_TOTAL_TEXT_CHARS = 15_000
MAX_LINKS_PER_PAGE = 50
CRAWL_SETTINGS = {
    "max_pages": MAX_CRAWL_PAGES,
    "max_depth": MAX_CRAWL_DEPTH,
    "page_text_chars": MAX_PAGE_TEXT_CHARS,
    "total_text_chars": MAX_TOTAL_TEXT_CHARS,
}
START_URLS = [
    "https://psi.nasa.gov/physci/repo/search?q=combustion",
    "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/",
    "https://www.nasa.gov/missions/station/a-researchers-guide-to-combustion-science/",
    "https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/",
]


def is_allowed_web_url(url):
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
        return (
            parsed.scheme == "https"
            and parsed.hostname in ALLOWED_WEB_HOSTS
            and parsed.port in (None, 443)
            and parsed.username is None
            and parsed.password is None
        )
    except ValueError:
        return False


def is_allowed_browser_resource(url):
    return is_allowed_web_url(url)


def control_browser_requests(route):
    request = route.request
    if is_allowed_browser_resource(request.url):
        route.continue_()
    else:
        route.abort()


def create_browser_context(playwright):
    browser = playwright.chromium.launch()
    try:
        context = browser.new_context()
        context.route("**/*", control_browser_requests)
        return browser, context
    except PlaywrightError:
        browser.close()
        raise


def render_page(page, url):
    page.goto(url, wait_until="domcontentloaded", timeout=15_000)
    try:
        page.wait_for_load_state("networkidle", timeout=1_500)
    except PlaywrightTimeoutError:
        pass

    rendered_url = page.url
    if not is_allowed_web_url(rendered_url):
        raise ValueError(f"Page redirected outside the allowed NASA hosts: {rendered_url}")

    page_text = page.locator("body").inner_text(timeout=5_000)
    links = page.locator("a[href]").evaluate_all(
        "(elements) => elements.map((element) => element.href)"
    )
    return rendered_url, " ".join(page_text.split()), links


def crawl_source_pages(start_urls=None):
    selected_urls = list(START_URLS if start_urls is None else start_urls)
    if not selected_urls:
        raise ValueError("Provide at least one start URL.")

    valid_start_urls = []
    for url in selected_urls:
        if not is_allowed_web_url(url):
            raise ValueError(
                f"Start URLs must use HTTPS and an allowed NASA host: {url}"
            )
        normalized_url = urldefrag(url).url
        if normalized_url not in valid_start_urls:
            valid_start_urls.append(normalized_url)

    pending = deque((url, 0) for url in valid_start_urls)
    visited = set()
    pages = []
    total_text_chars = 0

    try:
        with sync_playwright() as playwright:
            browser, context = create_browser_context(playwright)
            try:
                page = context.new_page()
                while (
                    pending
                    and len(visited) < MAX_CRAWL_PAGES
                    and total_text_chars < MAX_TOTAL_TEXT_CHARS
                ):
                    page_url, depth = pending.popleft()
                    page_url = urldefrag(page_url).url
                    if page_url in visited:
                        continue
                    visited.add(page_url)
                    LOGGER.info("Crawling page %d/%d: %s", len(visited), MAX_CRAWL_PAGES, page_url)

                    try:
                        rendered_url, page_text, links = render_page(page, page_url)
                    except (PlaywrightError, ValueError) as exc:
                        LOGGER.warning("Could not render %s: %s", page_url, exc)
                        continue

                    remaining_text_chars = MAX_TOTAL_TEXT_CHARS - total_text_chars
                    page_text = page_text[: min(MAX_PAGE_TEXT_CHARS, remaining_text_chars)]
                    if page_text:
                        pages.append({"url": rendered_url, "text": page_text})
                        total_text_chars += len(page_text)

                    for link_url in links[:MAX_LINKS_PER_PAGE]:
                        link_url = urldefrag(urljoin(rendered_url, link_url)).url
                        if (
                            is_allowed_web_url(link_url)
                            and depth < MAX_CRAWL_DEPTH
                            and link_url not in visited
                        ):
                            pending.append((link_url, depth + 1))
            finally:
                browser.close()
    except (PlaywrightError, ValueError) as exc:
        raise RuntimeError(f"Could not crawl NASA pages: {exc}") from exc

    if not pages:
        raise RuntimeError("The crawler did not retrieve any readable NASA pages.")
    LOGGER.info("Crawl complete: %d page(s), %d characters.", len(pages), total_text_chars)
    return pages
