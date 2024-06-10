interface accessToken {
  expiration: number,
  token: string
}

const watsonxConfig = {
  url: "YOUR_WATSONX_URL", // e.g. https://us-south.ml.cloud.ibm.com for watsonx SaaS
  apiKey: "YOUR_WATSONX_APIKEY", // Optional, if using watsonx SaaS
  username: "YOUR_WATSONX_USERNAME", // Optional, if using watsonx software
  password: "YOUR_WATSONX_PASSWORD", // Optional, if using watsonx software
  projectId: "YOUR_WATSONX_PROJECT_ID",
  modelId: "ibm/granite-34b-code-instruct",
  accessToken: {
    expiration: 0,
    token: ""
  }
}

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

async function getBearerToken(): Promise<accessToken> {
  if (watsonxConfig.url.includes('cloud.ibm.com')) {
    // watsonx SaaS
    const wxToken = await (await fetch(`https://iam.cloud.ibm.com/identity/token?apikey=${watsonxConfig.apiKey}&grant_type=urn:ibm:params:oauth:grant-type:apikey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    })).json();
    return {
      token: wxToken["access_token"],
      expiration: wxToken["expiration"]
    }
  } else {
    // watsonx Software
    const wxToken = await (await fetch(`${watsonxConfig.url}/icp4d-api/v1/authorize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        "username": watsonxConfig.username,
        "password": watsonxConfig.password
      })
    })).json();
    const wxTokenExpiry = await (await fetch(`${watsonxConfig.url}/usermgmt/v1/user/tokenExpiry`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${wxToken["token"]}`
      }
    })).json();
    return {
      token: wxToken["token"],
      expiration: wxTokenExpiry["exp"]
    }
  }
}

export function modifyConfig(config: Config): Config {
  config.models.push({
    requestOptions: {
      verifySsl: false
    },
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
      var now = (new Date()).getTime() / 1000;
      if (watsonxConfig.accessToken === undefined || now > watsonxConfig.accessToken.expiration) {
        watsonxConfig.accessToken = await getBearerToken();
      } else {
        console.log(`Reusing token (expires in ${(watsonxConfig.accessToken.expiration - now) / 60} mins)`);
      }
      const streamResponse = await fetch(`${watsonxConfig.url}/ml/v1/text/generation_stream?version=2023-05-29`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${watsonxConfig.accessToken.token}`
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
          "model_id": watsonxConfig.modelId,
          "project_id": watsonxConfig.projectId
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
  if (!config.requestOptions) {
    config.requestOptions = {}
  }
  config.requestOptions.verifySsl = false;
  return config;
}
