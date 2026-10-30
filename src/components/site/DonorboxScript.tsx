import Script from "next/script";

/**
 * Donorbox's loader. It resizes the embedded donation iframes to fit their
 * content (otherwise they stay at their fixed starting height) and handles
 * the checkout pop-up. Rendered beside each embed; Next.js loads it once.
 */
export function DonorboxScript() {
  return <Script src="https://donorbox.org/widget.js" strategy="afterInteractive" {...{ paypalExpress: "false" }} />;
}
