import type {Payment} from "./types.ts";
import Redis from "ioredis";
declare var self: Worker;

const redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");

self.onmessage = (event) => {
    const data: Payment = event.data;
    process_data(data);
}

const process_data = async (data: Payment) => {
    const final_data = {
        ...data,
        requestedAt : new Date().toISOString(),
    }
    const response_default: Response = await payments_request(process.env.PAYMENT_PROCESSOR_DEFAULT_URL || "http://localhost:8001/payments", final_data);
    if(response_default.ok){
        store_summary("default",final_data);
    }else{
        const response_fallback: Response = await payments_request(process.env.PAYMENT_PROCESSOR_FALLBACK_URL || "http://localhost:8002/payments", final_data);
        if(response_fallback.ok){
            store_summary("fallback",final_data);
        }
    }
    //postMessage(data);
}


function payments_request(URL: string, data: Payment): Promise<Response> {
    return fetch(URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

}

function store_summary(key_prefix: string, data: Payment){
    if(!data?.requestedAt) return;
    const QUEUE_FAILED_KEY = `queue:failed`;
    redisClient
        .multi()
        .hmset(`summary:${key_prefix}:data`, data.correlationId,data.amount)
        .zadd(`summary:${key_prefix}:history`, (new Date(data.requestedAt)).getTime(), data.correlationId)
        .lrem(QUEUE_FAILED_KEY, 1, JSON.stringify(data))
        .exec();
}
