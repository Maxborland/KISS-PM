import { faqsByLocale } from "./landing-faq";
import { copyFor, type LandingLocale } from "./landing-i18n";

const ROOT_URL = "https://kisspm.app/";

export function createLandingStructuredData(locale: LandingLocale) {
  const copy = copyFor(locale);
  const faqs = faqsByLocale[locale];
  const inLanguage = locale === "en" ? "en-US" : "ru-RU";
  const priceCurrency = locale === "en" ? "USD" : "RUB";

  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "KISS PM",
      url: ROOT_URL,
      logo: "https://kisspm.app/favicon.svg",
      description: copy.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "KISS PM",
      url: copy.siteUrl,
      inLanguage,
      description: copy.description,
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "KISS PM",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: copy.siteUrl,
      inLanguage,
      description: copy.description,
      softwareVersion: "closed alpha",
      isAccessibleForFree: true,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency,
        availability: "https://schema.org/PreOrder",
        description: copy.offerDescription,
      },
      additionalProperty: [
        {
          "@type": "PropertyValue",
          name: "Product status",
          value: "pre-release / closed alpha",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      inLanguage,
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.a,
        },
      })),
    },
  ];
}