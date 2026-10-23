import {Router} from 'express';

const router = Router();

router.get("/health",(req,res)=>{
    res.status(200).json({
        message: "API is healthy",
        data:{
            status: "ok",
        }
    })
})

export default router;