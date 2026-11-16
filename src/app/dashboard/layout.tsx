import Navigation from "@/components/navigation";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <Navigation />
      {children}
    </>
  );
}
