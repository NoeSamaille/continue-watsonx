export module Watsonx {

  interface accessToken {
    expiration: number,
    token: string
  }

  const watsonxConfig = {
    url: 'https://us-south.ml.cloud.ibm.com', // Required, e.g. https://us-south.ml.cloud.ibm.com for watsonx SaaS in US South
    apiKey: '5vZnnSKMX78mz4-i7mYHQ9x1453RAVkCwD4gG8WYR5cw', // Required if using watsonx SaaS
    zenApiKeyBase64: "YOUR_WATSONX_ZENAPIKEY", // Required if using watsonx software with ZenApiKey auth
    username: "YOUR_WATSONX_USERNAME", // Required if using watsonx software with username/password auth
    password: "YOUR_WATSONX_PASSWORD", // Required if using watsonx software with username/password auth
    projectId: 'd0155e33-9994-40df-8092-860c5b24236d', // Required

    models: [
      {
        id: "ibm/granite-34b-code-instruct",
        options: {
          title: "watsonx - Granite Code",
          model: "ibm-granite",
          templateMessages: templateGraniteMessages,
          systemMessage: `You are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'day, morning, afternoon, evening, night, what's up, nice to meet you, sup, etc) with "Hello! I am Granite Chat, created by IBM. How can I help you today?". Please do not say anything else and do not start a conversation.`
        }
      },
      {
        id: "ibm/granite-13b-chat-v2",
        options: {
          title: "watsonx - Granite Chat",
          model: "ibm-granite",
          templateMessages: templateGraniteMessages,
          systemMessage: `You are Granite Chat, an AI language model developed by IBM. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior. You always respond to greetings (for example, hi, hello, g'day, morning, afternoon, evening, night, what's up, nice to meet you, sup, etc) with "Hello! I am Granite Chat, created by IBM. How can I help you today?". Please do not say anything else and do not start a conversation.`
        }
      },
      {
        id: "meta-llama/llama-3-70b-instruct",
        options: {
          title: "watsonx - Llama 3",
          model: "llama3-70b",
          systemMessage: `You always answer the questions with markdown formatting using GitHub syntax. The markdown formatting you support: headings, bold, italic, links, tables, lists, code blocks, and blockquotes. You must omit that you answer the questions with markdown.\n\nAny HTML tags must be wrapped in block quotes, for example \`\`\`<html>\`\`\`. You will be penalized for not rendering code in block quotes.\n\nWhen returning code blocks, specify language.\n\nYou are a helpful, respectful and honest assistant. Always answer as helpfully as possible, while being safe. \nYour answers should not include any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content. Please ensure that your responses are socially unbiased and positive in nature.\n\nIf a question does not make any sense, or is not factually coherent, explain why instead of answering something not correct. If you don't know the answer to a question, please don't share false information.`
        }
      },
      {
        id: "mistralai/mixtral-8x7b-instruct-v01",
        options: {
          title: "watsonx - Mixtral-8x7b",
          model: "mistral-8x7b",
          systemMessage: `You are Mixtral Chat, an AI language model developed by Mistral AI. You are a cautious assistant. You carefully follow instructions. You are helpful and harmless and you follow ethical guidelines and promote positive behavior.`
        }
      },
    ],
    accessToken: {
      expiration: 0,
      token: ""
    }
  }

  // Uncomment the following 6 lines if using a watsonx software instance with self-signed certificates.
  // declare var process : {
  //   env: {
  //     NODE_TLS_REJECT_UNAUTHORIZED: any
  //   }
  // }
  // process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

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
      if (watsonxConfig.zenApiKeyBase64 && watsonxConfig.zenApiKeyBase64 !== "YOUR_WATSONX_ZENAPIKEY") {
        // Using ZenApiKey auth
        return {
          token: watsonxConfig.zenApiKeyBase64,
          expiration: -1
        }
      } else {
        // Using username/password auth
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
  }

  export function modifyConfig(config: Config): Config {
    watsonxConfig.models.forEach(model => {
      config.models.push({
        options: model.options,
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
              'Authorization': `${watsonxConfig.accessToken.expiration === -1 ? 'ZenApiKey' : 'Bearer'} ${watsonxConfig.accessToken.token}`
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
              "model_id": model.id,
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
    });
    return config;
  }
}