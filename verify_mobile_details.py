from playwright.sync_api import sync_playwright
import os

def verify_mobile_details():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use mobile viewport
        context = browser.new_context(viewport={"width": 375, "height": 812}, user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1")
        page = context.new_page()

        try:
            # Navigate to the test page
            page.goto("http://localhost:3000/test-details")

            # Wait for content to load
            page.wait_for_selector("text=Mobile Details Test", timeout=10000)

            # Check for Predecessors
            # Should see "Task 1" in a card-like view
            page.wait_for_selector("text=Task 1")

            # Check for "Type", "Lag", "Date" labels which are present in the mobile card view
            page.wait_for_selector("text=Type")
            page.wait_for_selector("text=Lag")

            # Check for Successors
            page.wait_for_selector("text=Task 3")

            # Take screenshot
            os.makedirs("/home/jules/verification", exist_ok=True)
            page.screenshot(path="/home/jules/verification/mobile_details.png", full_page=True)

            print("Verification successful, screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
            # Take screenshot anyway if possible
            try:
                os.makedirs("/home/jules/verification", exist_ok=True)
                page.screenshot(path="/home/jules/verification/mobile_details_failed.png")
            except:
                pass
        finally:
            browser.close()

if __name__ == "__main__":
    verify_mobile_details()
