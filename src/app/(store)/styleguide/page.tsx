import type { Metadata } from "next";
import Image from "next/image";
import {
  ArchPalm,
  Container,
  Eyebrow,
  Logo,
  OrnamentDivider,
  PassportStamp,
  PostcardFrame,
  Postmark,
  PostmarkWaves,
  Section,
  SectionHeading,
  StampFrame,
} from "@/components/brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { contrastPairs, contrastRatio, palette } from "@/lib/brand/palette";

export const metadata: Metadata = { title: "Styleguide", robots: { index: false } };

export default function StyleguidePage() {
  return (
    <>
      <Section>
        <Container>
          <SectionHeading
            eyebrow="Design system"
            title="Solei styleguide"
            lede="Luxury travel editorial — burgundy, baby pink, cream paper and gold hairlines."
          />
          <OrnamentDivider className="my-12" />

          <h3 className="mb-6 text-2xl">Palette</h3>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {Object.entries(palette).map(([name, hex]) => (
              <li key={name} className="bg-card overflow-hidden rounded-md border">
                <div className="h-20" style={{ background: hex }} />
                <div className="p-3 text-xs">
                  <p className="font-medium">{name}</p>
                  <p className="numeric text-muted-foreground">{hex}</p>
                </div>
              </li>
            ))}
          </ul>

          <h3 className="mt-16 mb-6 text-2xl">Contrast (WCAG AA, tested)</h3>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contrastPairs.map((p) => (
              <li
                key={`${p.fg}-${p.bg}`}
                className="flex items-center justify-between rounded-md px-4 py-3 text-sm"
                style={{ background: palette[p.bg], color: palette[p.fg] }}
              >
                <span>{p.use}</span>
                <span className="numeric">
                  {contrastRatio(palette[p.fg], palette[p.bg]).toFixed(1)}:1
                </span>
              </li>
            ))}
          </ul>

          <h3 className="mt-16 mb-6 text-2xl">Type</h3>
          <div className="flex flex-col gap-4">
            <p className="font-display text-burgundy text-6xl">A destination in scent.</p>
            <p className="font-display text-burgundy text-2xl italic">Made to remain.</p>
            <Eyebrow lines>Made to remain</Eyebrow>
            <p className="max-w-prose text-base">
              Body copy in the UI sans. Fragrance is more than something you wear. It&apos;s a
              memory, a feeling, and a little piece of somewhere that stays with you.
            </p>
            <p className="numeric text-muted-foreground text-sm">
              Numbers are tabular: AED 1,280.00 · 12/12
            </p>
          </div>

          <h3 className="mt-16 mb-6 text-2xl">Buttons</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="cta">Shop the collection</Button>
            <Button size="cta" variant="secondary">
              Plan your event
            </Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Text link</Button>
            <Button variant="destructive">Delete</Button>
            <Button size="xl">POS · Complete sale</Button>
          </div>

          <h3 className="mt-16 mb-6 text-2xl">Form controls</h3>
          <div className="grid max-w-md gap-2">
            <Label htmlFor="sg-phone">Mobile</Label>
            <Input id="sg-phone" placeholder="050 123 4567" inputMode="tel" />
            <div className="mt-2 flex gap-2">
              <Badge>Confirmed</Badge>
              <Badge variant="secondary">Potential</Badge>
              <Badge variant="outline">Draft</Badge>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="sand">
        <Container>
          <h3 className="mb-10 text-2xl">Travel motifs</h3>
          <div className="grid items-center gap-12 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col items-center gap-3">
              <PostmarkWaves />
              <span className="text-muted-foreground text-xs">PostmarkWaves</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <Postmark />
              <span className="text-muted-foreground text-xs">Postmark</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <ArchPalm />
              <span className="text-muted-foreground text-xs">ArchPalm</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <PassportStamp label="Capri" sublabel="08 / 12" className="size-24" />
                <PassportStamp label="Soho" variant="filled" tilt={5} className="size-24" />
                <PassportStamp label="?" variant="empty" tilt={0} className="size-24" />
              </div>
              <span className="text-muted-foreground text-xs">PassportStamp</span>
            </div>
          </div>
          <div className="mt-16 grid gap-12 sm:grid-cols-2">
            <div className="flex flex-col items-center gap-3">
              <StampFrame className="w-56">
                <Image
                  src="/images/destinations/capri.jpg"
                  alt="Lemons and blossom — Capri"
                  width={392}
                  height={244}
                  className="aspect-[4/5] object-cover"
                />
              </StampFrame>
              <span className="text-muted-foreground text-xs">StampFrame</span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <PostcardFrame tilt={-2} className="w-72">
                <Image
                  src="/images/destinations/santorini.jpg"
                  alt="Bougainvillea over Santorini"
                  width={410}
                  height={236}
                  className="aspect-[3/2] object-cover"
                />
              </PostcardFrame>
              <span className="text-muted-foreground text-xs">PostcardFrame</span>
            </div>
          </div>
        </Container>
      </Section>

      <Section tone="burgundy">
        <Container className="flex flex-col items-center gap-6 text-center">
          <Logo className="text-pink h-14" />
          <p className="font-display text-2xl italic">Collect the destinations. Keep the memory.</p>
          <div className="flex gap-3">
            <Button size="cta" variant="secondary">
              Plan your event
            </Button>
            <Button size="cta" variant="outline-light">
              Our story
            </Button>
          </div>
        </Container>
      </Section>
    </>
  );
}
