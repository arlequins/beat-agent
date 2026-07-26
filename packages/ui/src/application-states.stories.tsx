import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { Alert } from "./alert";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Select } from "./select";
import { Skeleton } from "./skeleton";
import { Switch } from "./switch";
import { Table, TableBody, TableCell, TableRow } from "./table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { Textarea } from "./textarea";

function ApplicationStates() {
  return (
    <div className="w-[360px] space-y-4">
      <Textarea aria-label="Description" placeholder="Description" />
      <Select aria-label="Status">
        <option>Active</option>
        <option>Archived</option>
      </Select>
      <div className="flex items-center justify-between text-sm">
        <span>Notifications</span>
        <Switch aria-label="Notifications" />
      </div>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell>Example item</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TabsContent>
        <TabsContent value="active">No active items</TabsContent>
      </Tabs>
      <Alert variant="destructive">The request could not be completed.</Alert>
      <Skeleton className="h-16" />
      <Pagination
        onPageChange={() => undefined}
        page={1}
        pageSize={10}
        total={24}
      />
      <EmptyState
        action={<Button>Create item</Button>}
        description="Create the first item to get started."
        icon={FileText}
        title="No items yet"
      />
    </div>
  );
}

const meta = {
  component: ApplicationStates,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  title: "Patterns/Application states",
} satisfies Meta<typeof ApplicationStates>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
