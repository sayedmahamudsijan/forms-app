const templateController = require('./controllers/templateController');
console.log('templateController:', Object.keys(templateController));
console.log('getTemplate type:', Array.isArray(templateController.getTemplate) ? 'array' : typeof templateController.getTemplate);
console.log('getResults type:', Array.isArray(templateController.getResults) ? 'array' : typeof templateController.getResults);
