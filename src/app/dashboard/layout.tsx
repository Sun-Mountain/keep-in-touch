import Navigation from "@/components/navigation";

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Navigation />
      {children}
    </>
  );
}
