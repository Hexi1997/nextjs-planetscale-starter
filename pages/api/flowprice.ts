import prisma, { Prisma } from "@db";
import { NextApiRequest, NextApiResponse } from "next";
import nc from "next-connect";

const TEN_MINUTES = 10 * 60 * 1000;

export function fetchWithTimeout(url, options, timeout) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), timeout)
    )
  ]);
}

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
    const data = await prisma.saveData.findFirst();
    const savePrice = data?.savePrice || null;
    const saveTime = data?.saveTime || null;
    const dateNow = Date.now();
    if (savePrice && Math.abs(dateNow - Number(saveTime)) < TEN_MINUTES) {
      console.log('cache price: ', savePrice);
      res.json({ price: Number(savePrice), isCache: true });
    } else {
      const response = await fetchWithTimeout(
        'https://api.livecoinwatch.com/coins/single',
        {
          method: 'POST',
          headers: new Headers({
            'content-type': 'application/json',
            // TODO: 使用个人账号申请的livecoinwatch api key，生产环境中应该使用公司的key
            // liveconinwatch账号申请的key免费额度每天10000次请求，这里在nextjs serve端做了缓存，每10分钟更新一次，理论上每天只需调用api-key 244次，远远满足需求
            'x-api-key': '26174cf4-bc73-4c29-965f-754532f97015'
          }),
          body: JSON.stringify({
            currency: 'USD',
            code: 'FLOW',
            meta: true
          })
        },
        5000
      )
        .then((v:any) => v.json())
        .catch(console.error);
      if (response) {
        const price = response.rate;
        if (price) {
          if(!savePrice){
            await prisma.saveData.create({
              data: {
                savePrice: String(price),
                saveTime: String(dateNow)
              }
            })
          }else {
            await prisma.saveData.update({
              where:{
                id:1
              },
              data: {
                savePrice: String(price),
                saveTime: String(dateNow)
              }
            })
          }
          res.json({ price, isCache: false });
        }
      } else {
        res.json({});
      }
    }
}

export default nc().get(handler);
