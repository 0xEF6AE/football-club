import Link from "next/link";
import { buttonStyles } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="font-display text-6xl text-muted">404</p>
      <h1 className="text-lg font-semibold">페이지를 찾을 수 없어요</h1>
      <p className="text-sm text-muted">주소가 바뀌었거나 삭제된 항목일 수 있어요.</p>
      <Link href="/matches" className={buttonStyles({ variant: "secondary" })}>
        경기 목록으로
      </Link>
    </div>
  );
}
