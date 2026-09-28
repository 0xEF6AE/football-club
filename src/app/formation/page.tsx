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
        description="쿼터별 라인업을 확인해요. 라인업을 짜고 고치는 건 관리자만 할 수 있어요."
      />
      {/* ?load= 를 읽는 useSearchParams 때문에 Suspense 경계가 필요하다. */}
      <Suspense fallback={<FormationSkeleton />}>
        <FormationPageContent />
      </Suspense>
    </Container>
  );
}
