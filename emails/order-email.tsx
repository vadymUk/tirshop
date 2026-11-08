import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";
import { emailText, OrderItemsTable } from "@/emails/order-items-table";
import type { EmailOrder } from "@/emails/types";

/** Notification for the seller: everything needed to process the order. */
export default function OrderEmail({ order }: { order: EmailOrder }) {
  return (
    <Html lang="uk">
      <Head />
      <Preview>
        Нове замовлення {order.orderNumber} від {order.customerName}
      </Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", background: "#f6f6f6" }}>
        <Container style={{ background: "#fff", padding: 24, maxWidth: 600 }}>
          <Heading as="h1" style={{ fontSize: 22 }}>
            Нове замовлення {order.orderNumber}
          </Heading>
          <Text style={emailText}>
            <strong>Дата:</strong> {order.orderDate}
            <br />
            <strong>Статус замовлення:</strong> {order.status}
            <br />
            <strong>Статус оплати:</strong> {order.paymentStatus}
          </Text>

          <Heading as="h2" style={{ fontSize: 16 }}>
            Клієнт
          </Heading>
          <Text style={emailText}>
            {order.customerName}
            <br />
            Email: {order.customerEmail}
            <br />
            Телефон: {order.customerPhone}
          </Text>

          <Heading as="h2" style={{ fontSize: 16 }}>
            Доставка
          </Heading>
          <Text style={emailText}>
            Країна: {order.country}
            <br />
            Місто: {order.city}
            <br />
            Індекс: {order.postalCode}
            <br />
            Адреса: {order.address}
            <br />
            Квартира / будинок: {order.apartment ?? "—"}
          </Text>
          <Text style={emailText}>
            <strong>Коментар:</strong> {order.notes ?? "—"}
          </Text>

          <Heading as="h2" style={{ fontSize: 16 }}>
            Товари
          </Heading>
          <OrderItemsTable items={order.items} total={order.total} showDescriptions />
          <Text style={emailText}>Валюта: {order.currency}</Text>
        </Container>
      </Body>
    </Html>
  );
}
