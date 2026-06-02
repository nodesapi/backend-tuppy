export declare class CreateOrderItemDto {
    blockId?: string;
    productName: string;
    imageUrl?: string;
    price: number;
    quantity: number;
}
export declare class CreateOrderDto {
    tenantUsername: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    shippingAddress?: string;
    notes?: string;
    channel?: string;
    items: CreateOrderItemDto[];
}
export declare class UpdateOrderStatusDto {
    status: string;
    internalNote?: string;
    awbNumber?: string;
    courier?: string;
}
