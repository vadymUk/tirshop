import { Body, Container, Head, Heading, Html, Preview, Text } from "@react-email/components";

export function OrderStatusEmail({ name, number, status }: { name: string; number: number; status: string }) {
  return <Html lang="uk"><Head /><Preview>{`Статус замовлення #${number}: ${status}`}</Preview><Body style={{ backgroundColor: "#f5f7fa", fontFamily: "Arial, sans-serif", padding: "24px" }}>
    <Container style={{ backgroundColor: "#ffffff", padding: "32px", borderRadius: "8px" }}>
      <Heading>TIR Shop</Heading><Text>Вітаємо, {name}!</Text>
      <Text>Статус вашого замовлення #{number}: <strong>{status}</strong>.</Text>
      <Text>Дякуємо за ваше замовлення.</Text>
    </Container>
  </Body></Html>;
}
