import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

export function Pagination(props: {
  onPageChange: (page: number) => void;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pageCount = Math.max(1, Math.ceil(props.total / props.pageSize));
  return (
    <nav aria-label="Pagination" className="flex items-center gap-2">
      <Button
        aria-label="Previous page"
        disabled={props.page <= 1}
        onClick={() => props.onPageChange(props.page - 1)}
        size="icon"
        variant="ghost"
      >
        <ChevronLeft />
      </Button>
      <span aria-live="polite">
        Page {props.page} of {pageCount}
      </span>
      <Button
        aria-label="Next page"
        disabled={props.page >= pageCount}
        onClick={() => props.onPageChange(props.page + 1)}
        size="icon"
        variant="ghost"
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
