export type Payment = {
    correlationId: string,
    amount: number,
    requestedAt?: string
}

export type PaymentsSummaryData = {
    totalRequests: number,
    totalAmount: number
}

export type PaymentsSummary = {
    default: PaymentsSummaryData,
    fallback: PaymentsSummaryData
}
