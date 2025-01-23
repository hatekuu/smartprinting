const getProductsPipeline = (filters) => {
    const pipeline = [{ $match: filters }];
    return pipeline;
  };
  
  module.exports = { getProductsPipeline };
  