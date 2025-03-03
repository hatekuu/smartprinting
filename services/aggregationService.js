const { getDB } = require('../config/db');

async function getPipelineFromDB(pipelineId) {
    try {
        const db = getDB()
        const aggregateCollection = db.collection("aggregate");
        // Lấy pipeline từ MongoDB
        const pipelineDoc = await aggregateCollection.findOne({ _id: pipelineId });
        if (!pipelineDoc || !pipelineDoc.pipeline) {
            throw new Error("Pipeline không tồn tại trong MongoDB.");
        }
        return pipelineDoc.pipeline;
    } catch (error) {
        console.error("Lỗi khi lấy pipeline:", error);
        return [];
    } 
}


module.exports = { getPipelineFromDB };
