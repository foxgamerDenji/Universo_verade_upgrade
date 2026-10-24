import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});if(req.method!=="POST")return new Response(JSON.stringify({ok:false,error:"Method not allowed"}),{status:405,headers:{...cors,"Content-Type":"application/json"}});
try{
 const auth=req.headers.get("Authorization");if(!auth)throw new Error("Faça login primeiro.");
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,secret=Deno.env.get("ADMIN_ACTIVATION_CODE_HASH")!;
 const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user},error:ue}=await userClient.auth.getUser();if(ue||!user)throw new Error("Sessão inválida.");
 const {code}=await req.json();if(typeof code!=="string"||!code.trim())throw new Error("Informe o código.");
 // Store SHA-256 hex digest of the activation code in ADMIN_ACTIVATION_CODE_HASH.
 const bytes=new TextEncoder().encode(code.trim());const digest=await crypto.subtle.digest("SHA-256",bytes);
 const hex=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
 if(hex!==secret)throw new Error("Código incorreto.");
 const admin=createClient(url,service);
 const {error}=await admin.from("profiles").update({role:"admin"}).eq("id",user.id);
 if(error)throw new Error("Não foi possível atualizar o perfil.");
 return new Response(JSON.stringify({ok:true}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:"Erro inesperado"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const auth=req.headers.get("Authorization");if(!auth)throw new Error("Entre na sua conta.");
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error:ue}=await uc.auth.getUser();if(ue||!user)throw new Error("Sessão inválida.");
 const {items}=await req.json();if(!Array.isArray(items)||items.length<1||items.length>30)throw new Error("Carrinho inválido.");
 const ids=[...new Set(items.map((x:any)=>x.product_id))];if(ids.some((x:any)=>typeof x!=="string"))throw new Error("Produto inválido.");
 const admin=createClient(url,service);const {data:ps,error:pe}=await admin.from("products").select("id,name,price,stock,active").in("id",ids);if(pe)throw pe;
 const normalized=items.map((x:any)=>{const p=ps?.find((y:any)=>y.id===x.product_id);const q=Number(x.quantity);if(!p||!p.active||!Number.isInteger(q)||q<1||q>20||q>p.stock)throw new Error("Produto indisponível ou estoque insuficiente.");return {product_id:p.id,product_name:p.name,unit_price:Number(p.price),quantity:q}});
 const total=normalized.reduce((s:any,x:any)=>s+x.unit_price*x.quantity,0);
 const {data:order,error:oe}=await admin.from("orders").insert({user_id:user.id,total,status:"pending",payment_provider:"mercado_pago"}).select("id").single();if(oe)throw oe;
 const {error:ie}=await admin.from("order_items").insert(normalized.map((x:any)=>({...x,order_id:order.id})));if(ie)throw ie;
 const token=Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN");const base=Deno.env.get("PUBLIC_SITE_URL");if(!token||!base)throw new Error("Checkout ainda não configurado pelo administrador.");
 const pref=await fetch("https://api.mercadopago.com/checkout/preferences",{method:"POST",headers:{"Authorization":`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({items:normalized.map((x:any)=>({id:x.product_id,title:x.product_name,quantity:x.quantity,currency_id:"BRL",unit_price:x.unit_price})),external_reference:order.id,back_urls:{success:`${base}/?payment=success`,failure:`${base}/?payment=failure`,pending:`${base}/?payment=pending`},auto_return:"approved"})});
 const data=await pref.json();if(!pref.ok)throw new Error("Não foi possível criar o pagamento. Verifique a configuração do Mercado Pago.");
 await admin.from("orders").update({checkout_url:data.init_point,payment_reference:data.id}).eq("id",order.id);
 return new Response(JSON.stringify({url:data.init_point,orderId:order.id}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({error:e instanceof Error?e.message:"Erro inesperado"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
Deno.serve(async req=>{if(req.method==="OPTIONS")return new Response("ok",{headers:cors});try{
 const auth=req.headers.get("Authorization");if(!auth)throw new Error("Entre na sua conta.");
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
 const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}});const {data:{user},error:ue}=await uc.auth.getUser();if(ue||!user)throw new Error("Sessão inválida.");
 const {title,body}=await req.json();if(typeof title!=="string"||title.trim().length<3||title.length>120||typeof body!=="string"||body.trim().length<5||body.length>3000)throw new Error("Confira o título e o texto da ideia.");
 const admin=createClient(url,service);const {data:idea,error}=await admin.from("ideas").insert({user_id:user.id,title:title.trim(),body:body.trim()}).select("id,title,body,created_at").single();if(error)throw error;
 // Configure RESEND_API_KEY and ADMIN_EMAIL in Edge Function secrets. Use a verified sender domain in Resend.
 const resend=Deno.env.get("RESEND_API_KEY"),to=Deno.env.get("ADMIN_EMAIL"),from=Deno.env.get("RESEND_FROM");
 let emailSent=false;
 if(resend&&to&&from){const r=await fetch("https://api.resend.com/emails",{method:"POST",headers:{"Authorization":`Bearer ${resend}`,"Content-Type":"application/json"},body:JSON.stringify({from,to:[to],subject:`Nova ideia no Universo Verade: ${idea.title}`,text:`Uma nova ideia foi enviada.\n\nTítulo: ${idea.title}\nUsuário: ${user.email||user.id}\n\n${idea.body}\n\nID: ${idea.id}`})});emailSent=r.ok}
 return new Response(JSON.stringify({ok:true,emailSent,ideaId:idea.id}),{headers:{...cors,"Content-Type":"application/json"}});
}catch(e){return new Response(JSON.stringify({ok:false,error:e instanceof Error?e.message:"Erro inesperado"}),{status:400,headers:{...cors,"Content-Type":"application/json"}})}});

