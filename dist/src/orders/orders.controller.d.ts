import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    checkout(dto: CreateOrderDto): Promise<{
        success: boolean;
        order: ({
            items: {
                id: string;
                blockId: string | null;
                orderId: string;
                productName: string;
                imageUrl: string | null;
                price: number;
                quantity: number;
                subtotal: number;
            }[];
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            paymentMethod: string | null;
            tenantId: string;
            grandTotal: number;
            platformFee: number;
            netAmount: number;
            customerName: string;
            customerPhone: string;
            customerEmail: string | null;
            shippingAddress: string | null;
            notes: string | null;
            channel: string;
            internalNote: string | null;
            awbNumber: string | null;
            courier: string | null;
            orderNumber: string;
            paymentGateway: string | null;
            paymentLink: string | null;
            waSent: boolean;
        }) | null;
        waLink: string | null;
    }>;
    trackOrder(orderNumber: string, phone: string): Promise<{
        tenant: {
            displayName: string;
        };
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
    getMyOrders(req: any, status?: string): Promise<({
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    })[]>;
    getPendingCount(req: any): Promise<{
        count: number;
    }>;
    getOrderDetail(id: string, req: any): Promise<{
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
    updateOrderStatus(id: string, dto: UpdateOrderStatusDto, req: any): Promise<{
        items: {
            id: string;
            blockId: string | null;
            orderId: string;
            productName: string;
            imageUrl: string | null;
            price: number;
            quantity: number;
            subtotal: number;
        }[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        paymentMethod: string | null;
        tenantId: string;
        grandTotal: number;
        platformFee: number;
        netAmount: number;
        customerName: string;
        customerPhone: string;
        customerEmail: string | null;
        shippingAddress: string | null;
        notes: string | null;
        channel: string;
        internalNote: string | null;
        awbNumber: string | null;
        courier: string | null;
        orderNumber: string;
        paymentGateway: string | null;
        paymentLink: string | null;
        waSent: boolean;
    }>;
}
