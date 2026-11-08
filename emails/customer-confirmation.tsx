import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { emailText, OrderItemsTable } from "@/emails/order-items-table";
import type { EmailOrder } from "@/emails/types";

/** Confirmation sent to the customer after placing an order. */
export default function CustomerConfirmationEmail({ order }: { order: EmailOrder }) {
  return (
    <Html lang="uk">
      <Head />
      <Preview>Дякуємо! Замовлення {order.orderNumber} прийнято</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", background: "#f6f6f6" }}>
        <Container style={{ background: "#fff", padding: 24, maxWidth: 560 }}>
          <Heading as="h1" style={{ fontSize: 22 }}>
            Дякуємо за замовлення, {order.customerName}!
          </Heading>
          <Text style={emailText}>
            <strong>Номер замовлення:</strong> {order.orderNumber}
            <br />
            <strong>Дата:</strong> {order.orderDate}
          </Text>

          <OrderItemsTable items={order.items} total={order.total} />

          <Heading as="h2" style={{ fontSize: 16 }}>
            Доставка
          </Heading>
          <Text style={emailText}>
            {order.address}
            {order.apartment ? `, ${order.apartment}` : ""}
            <br />
            {order.postalCode} {order.city}, {order.country}
          </Text>

          <Text style={emailText}>
            Найближчим часом продавець зв&apos;яжеться з вами, щоб підтвердити замовлення,
            узгодити оплату та доставку.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
