import type { Metadata } from "next";
import { Suspense } from "react";
import { Container, PageHeader } from "@/components/ui/PageHeader";
import { FormationPageContent, FormationSkeleton } from "@/features/formations/components/FormationBuilder";

export const metadata: Metadata = { title: "포메이션" };

export default function FormationPage() {
  return (
    <Container size="wide">
      <PageHeader
        title="포메이션"
        description="참석 선수를 고르고 1~4쿼터를 자동 배치한 뒤, 쿼터마다 자리를 눌러 원하는 대로 바꿔 보세요."
      />
      {/* ?load= 를 읽는 useSearchParams 때문에 Suspense 경계가 필요하다. */}
      <Suspense fallback={<FormationSkeleton />}>
        <FormationPageContent />
      </Suspense>
    </Container>
  );
}
