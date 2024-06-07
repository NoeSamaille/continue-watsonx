function templateGraniteMessages(msgs: ChatMessage[]): string {
  let prompt = "";
  if (msgs[0].role === "system") {
    prompt += `<|system|>\n${msgs[0].content}\n`;
    msgs.shift();
  }
  prompt += "<|user|>\n";
  for (let msg of msgs) {
    prompt += `${msg.content}\n`;
  }
  prompt += "<|assistant|>\n";
  return prompt;
}

async function getBearerToken(apiKey: string): Promise<object> {
  return (await fetch(`https://iam.cloud.ibm.com/identity/token?apikey=${apiKey}&grant_type=urn:ibm:params:oauth:grant-type:apikey`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    }
  })).json();
}

var wxAccessToken:any = undefined;

export function modifyConfig(config: Config): Config {
  config.models.push({
    options: {
      title: "watsonx - Granite 34B Code Instruct",
      model: "granite-34b-code-instruct",
      templateMessages: templateGraniteMessages,
      systemMessage: `You are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'day, morning, afternoon, evening, night, what's up, nice to meet you, sup, etc) with "Hello! I am Granite Chat, created by IBM. How can I help you today?". Please do not say anything else and do not start a conversation.`
    },
    streamCompletion: async function* (
      prompt: string,
      options: CompletionOptions,
    ) {
      var now = (new Date()).getTime()/1000;
      if (wxAccessToken===undefined || now > wxAccessToken["expiration"]) {
        wxAccessToken = await getBearerToken("YOUR_WATSONX_API_KEY");
      } else {
        console.log(`Reusing token (expires in ${(wxAccessToken["expiration"] - now)/60} mins)`);
      }
      const streamResponse = await fetch(`https://us-south.ml.cloud.ibm.com/ml/v1/text/generation_stream?version=2023-05-29`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${wxAccessToken["access_token"]}`
        },
        body: JSON.stringify({
          "input": prompt,
          "parameters": {
            "decoding_method": "greedy",
            "max_new_tokens": options.maxTokens ?? 1024,
            "min_new_tokens": 1,
            "stop_sequences": [],
            "repetition_penalty": 1
          },
          "model_id": "ibm/granite-34b-code-instruct",
          "project_id": "YOUR_WATSONX_PROJECT_ID"
        })
      });
      if (!streamResponse.ok || streamResponse.body === null) {
        console.error("No response received, reverting to fallback mode");
      } else {
        const reader = streamResponse.body.getReader();
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;

          // Decode the stream
          const textResponseMsg = new TextDecoder().decode(chunk.value);
          const lines = textResponseMsg.split(/\r?\n/);

          let generatedChunk = "";
          let generatedTextIndex = undefined;
          lines.forEach((el) => {
            if (el.startsWith("id:")) {
              generatedTextIndex = parseInt(el.replace(/^id:\s+/, ""));
              if (isNaN(generatedTextIndex))
                console.error(`Unable to parse stream chunk ID: ${el}`);
            } else if (el.startsWith("data:")) {
              const dataStr = el.replace(/^data:\s+/, "");
              try {
                const data = JSON.parse(dataStr);
                data.results.forEach((result: any) => {
                  generatedChunk += result.generated_text || "";
                });
              } catch (e) {
                console.error(e);
              }
            }
          });

          yield generatedChunk;
        }
      }
    }
  });
  return config;
}
