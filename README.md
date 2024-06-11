# watsonx CustomLLM definition for Continue

Simple CustomLLM definition to leverage IBM watsonx LLMs on Continue extentions.

![watsonx with Continue GIF](./assets/continue-watsonx.gif)

## Features

- [x] Support watsonx.ai SaaS.
- [x] Support streaming of response.
- [x] Support `granite-34b-code-instruct`.
- [x] Bearer token rotation.
- [x] Custom prompt template for Granite.
- [x] Support watsonx.ai Software.
- [x] Support non-granite LLMs.
- [ ] Create separate Chat and Completion models.

## Get started (~ 2min)

1. Install [Continue](https://www.continue.dev/) extension (tested with VSCode extension).
2. Make a local copy of your local Continue config:
    ```sh
    mv ~/.continue/config.ts ~/.continue/config-backup.ts
    ```
3. Copy the provided `config.ts` in `~/.continue/config.ts`:
    ```sh
    wget https://raw.githubusercontent.com/NoeSamaille/continue-watsonx/main/config.ts -O ~/.continue/config.ts
    ```
4. Update `watsonxConfig` in `~/.continue/config.ts` with your target configuration:
   1. If using watsonx SaaS:
      - Replace `YOUR_WATSONX_URL` with your watsonx SaaS endpoint, e.g. `https://us-south.ml.cloud.ibm.com` for US South region.
      - Replace `YOUR_WATSONX_APIKEY` with your watsonx API Key.
      - Replace `YOUR_WATSONX_PROJECT_ID` with your watsonx project ID.
   2. If using watsonx software:
      1. *Option 1*: using username/password authentication:
         - Replace `YOUR_WATSONX_URL` with your watsonx software endpoint, e.g. `https://cpd-watsonx.apps.example.com`.
         - Replace `YOUR_WATSONX_USERNAME` with your watsonx username, e.g. `cpadmin`.
         - Replace `YOUR_WATSONX_PASSWORD` with your watsonx password.
         - Replace `YOUR_WATSONX_PROJECT_ID` with your watsonx project ID.
      2. *Option 2*: using API Key authentication:
         - Replace `YOUR_WATSONX_URL` with your watsonx software endpoint, e.g. `https://cpd-watsonx.apps.example.com`.
         - Replace `YOUR_WATSONX_ZENAPIKEY` with your watsonx Zen API Key. To generate it:
            1. Log in to the CPD web client.
            2. From the toolbar, click your avatar.
            3. Click **Profile and settings**.
            4. Click **API key** > **Generate new key**.
            5. Click **Generate**.
            6. Click **Copy** and save your key somewhere safe. You cannot recover this key if you lose it.
            7. Generate your ZenApiKey by running the following command: `echo "<username>:<apikey>" | base64`, replacing `<username>` with your CPD username and `<apikey>` with the API Key you just created.
         - Replace `YOUR_WATSONX_PROJECT_ID` with your watsonx project ID.
    - 
      - **Note**: if using watsonx software instance with self-signed/untrusted TLS certificates, uncomment the following lines in `~/.continue/config.ts` to bypass SSL certificate verification:

        ```ts
        declare var process : {
            env: {
                NODE_TLS_REJECT_UNAUTHORIZED: any
            }
        }
        process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
        ```
   3. *Optionally*, update `models` to comment/uncomment/edit model list based on LLMs deployed in your watsonx instance.
5. Enjoy!
