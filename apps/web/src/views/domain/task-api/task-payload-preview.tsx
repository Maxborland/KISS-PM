"use client";

import { CardPanel } from "@/components/domain/card-panel";

export type TaskPayloadPreviewProps = {
  title: string;
  endpointLabel: string;
  method: "POST" | "PATCH";
  url: string;
  body: unknown;
};

export function TaskPayloadPreview({
  title,
  endpointLabel,
  method,
  url,
  body
}: TaskPayloadPreviewProps) {
  const json = JSON.stringify(body, null, 2);
  return (
    <CardPanel title={title} subtitle={endpointLabel} className="u-mt-3">
      <p className="u-text-xs u-text-muted u-mb-2">
        <span className="mono u-text-strong">{method}</span>{" "}
        <span className="mono">{url}</span>
      </p>
      <pre className="task-payload-preview" data-testid="task-payload-preview">
        {json}
      </pre>
    </CardPanel>
  );
}
