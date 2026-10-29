import type { Metadata } from "next";
import { EventNewsForm } from "@/components/store/feedback/event-news";
import { eventNewsCopy as c } from "@/content/feedback";

export const metadata: Metadata = { title: c.metaTitle, description: c.lede };

/** Sign up to hear about upcoming pop-ups and exhibitions (link from Instagram, footer, QR). */
export default function EventNewsPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-5 py-24">
      <p className="eyebrow text-primary text-[0.62rem]">{c.eyebrow}</p>
      <h1 className="display text-4xl sm:text-5xl">{c.title}</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">{c.lede}</p>
      <EventNewsForm />
    </div>
  );
}
