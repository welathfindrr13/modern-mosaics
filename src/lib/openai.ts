import OpenAI from 'openai';

// Initialize the OpenAI client with API key from environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log('OpenAI client initialized');

export default openai;
