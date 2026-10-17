import { PlaneCursor } from "@/components/motion/plane-cursor";
import { CartDrawer } from "@/components/store/cart/cart-drawer";
import { SiteFooter } from "@/components/store/site-footer";
import { SiteHeader } from "@/components/store/site-header";

export default function StoreLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="theme-store bg-background text-foreground flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <SiteFooter />
      <CartDrawer />
      <PlaneCursor />
    </div>
  );
}
