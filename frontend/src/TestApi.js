import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert } from 'react-bootstrap';

const TestApi = () => {
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log('API URL:', process.env.REACT_APP_API_URL);
    axios.get(`${process.env.REACT_APP_API_URL}/api/templates`)
      .then(res => {
        console.log('Templates:', res.data);
        setResponse(JSON.stringify(res.data, null, 2));
        setError(null);
      })
      .catch(err => {
        console.error('Error:', err);
        setError(err.response?.data?.message || 'Failed to fetch templates');
      });
  }, []);

  return (
    <div>
      <h2>API Test</h2>
      <p>API URL: {process.env.REACT_APP_API_URL}</p>
      {error && <Alert variant="danger">{error}</Alert>}
      {response && <pre>{response}</pre>}
    </div>
  );
};

export default TestApi;