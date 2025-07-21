import type {Payment, PaymentsSummary} from "./types.ts";
import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL || "redis://127.0.0.1:6379");
const worker = new Worker('./worker.ts');
Bun.serve(
    {
        port: Number(process.env.PORT || 9999),
        routes: {
            "/payments": {
                POST: async request => {
                    const body: Payment = await request.json();
                    worker.postMessage(body);
                    return new Response(null, {status: 201, headers: {"Content-Type": "ext/plain"}});
                }
            },
            "/payments-summary": {
                GET: async (request) => {
                    console.log(request.url)
                    const url = new URL(request.url);
                    const from = url.searchParams.get("from") || "1970-01-01T00:00:00Z";
                    const to = url.searchParams.get("to") || "1970-01-01T00:00:00Z";

                    const ids_default: string[] = await redisClient.zrangebyscore("summary:default:history", (new Date(from)).getTime(), (new Date(to)).getTime());
                    const amounts_default = (ids_default.length > 0)?await redisClient.hmget("summary:default:data", ...ids_default) : [];
                    const ids_fallback: string[] = await redisClient.zrangebyscore("summary:fallback:history", (new Date(from)).getTime(), (new Date(to)).getTime());
                    const amounts_fallback = (ids_fallback.length > 0)? await redisClient.hmget("summary:fallback:data", ...ids_fallback) : [];

                    const data: PaymentsSummary = {
                        default: {
                            totalRequests: amounts_default.length,
                            totalAmount: Number(amounts_default.map((v) => parseFloat(v || "0") ).reduce((acc, val) => acc + val, 0).toFixed(2))
                        },
                        fallback: {
                            totalRequests: amounts_fallback.length,
                            totalAmount: Number(amounts_fallback.map((v) => parseFloat(v || "0") ).reduce((acc, val) => acc + val, 0).toFixed(2))
                        }
                    }
                    return new Response(JSON.stringify(data), {
                        status: 200,
                        headers: {"Content-Type": "application/json"}
                    });
                }
            },
        },
        fetch(req) {
            return new Response("Not Found", {status: 404});
        },
    }
)
