Forms App
A web application for creating and filling customizable forms, similar to Google Forms.
Setup

Clone the repository.
Copy .env.example to .env and fill in the values.
Install dependencies:cd backend && npm install
cd ../frontend && npm install


Start the app:docker-compose up



Deployment

Backend: Deploy to Render with the .env file.
Frontend: Deploy to Vercel with the build command npm run build.

Features

User authentication with JWT
Template creation with up to 4 questions per type
Full-text search with PostgreSQL
Real-time comments with Socket.IO
Responsive design with Bootstrap
Light/dark themes
Admin panel for user management
#   f o r m s - a p p  
 #   f o r m s - a p p  
 