import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { StarterKit } from "@tiptap/starter-kit";
import { PageChartNode } from "./page-chart-extension";

/** Everything a stored page may contain, so loading never drops content. */
export const PAGE_EXTENSIONS = [
  StarterKit,
  Markdown,
  Table,
  TableRow,
  TableHeader,
  TableCell,
  TaskList,
  TaskItem.configure({ nested: true }),
  Image,
  PageChartNode,
];
