import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPayloadLibrary } from '@/services/payload-service';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function PayloadsPage() {
  const payloads = await getPayloadLibrary();

  return (
    <div className="container mx-auto py-8 px-4 md:px-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Successful Payloads</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Payload Library</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            This section displays a collection of successful attack prompts saved from various operations.
            The &apos;ORATOR&apos; flow uses this library to improve the effectiveness of future AI-generated attacks.
          </p>

          {payloads.length === 0 ? (
             <div className="text-center py-8 text-muted-foreground">
               No successful payloads recorded yet.
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Target LLM</TableHead>
                  <TableHead>Attack Vector</TableHead>
                  <TableHead className="w-[50%]">Prompt</TableHead>
                  <TableHead>ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payloads.map((payload) => (
                  <TableRow key={payload.id}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {payload.createdAt ? format(payload.createdAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>{payload.targetLLM}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{payload.attackVector}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      <div className="max-h-[100px] overflow-y-auto whitespace-pre-wrap">
                        {payload.prompt}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {payload.id?.substring(0, 8)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
