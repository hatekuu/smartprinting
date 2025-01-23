const aggregationService = async (collection, pipeline) => {
    try {
      return await collection.aggregate(pipeline).toArray();
    } catch (error) {
      throw new Error('Lỗi khi thực thi pipeline: ' + error.message);
    }
  };
  
  module.exports = aggregationService;
  