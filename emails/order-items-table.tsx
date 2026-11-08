import { Column, Hr, Row, Section, Text } from "@react-email/components";
import type { EmailOrderItem } from "@/emails/types";

export const emailText = { fontSize: 14, lineHeight: "20px", margin: "0 0 8px" } as const;
const muted = { ...emailText, color: "#666", margin: 0 } as const;

type OrderItemsTableProps = {
  items: EmailOrderItem[];
  total: string;
  showDescriptions?: boolean;
};

export function OrderItemsTable({ items, total, showDescriptions }: OrderItemsTableProps) {
  return (
    <Section>
      <Hr />
      {items.map((item, index) => (
        <Row key={index} style={{ marginBottom: 12 }}>
          <Column style={{ ...emailText, width: "65%", verticalAlign: "top" }}>
            <strong>{item.name}</strong>
            {showDescriptions && item.description ? (
              <Text style={muted}>{item.description}</Text>
            ) : null}
            <Text style={muted}>
              {item.quantity} × {item.unitPrice}
            </Text>
          </Column>
          <Column align="right" style={{ ...emailText, verticalAlign: "top" }}>
            {item.subtotal}
          </Column>
        </Row>
      ))}
      <Hr />
      <Text style={{ ...emailText, fontSize: 16, textAlign: "right" }}>
        <strong>Разом: {total}</strong>
      </Text>
    </Section>
  );
}
