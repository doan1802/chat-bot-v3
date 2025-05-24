import asyncio
import json

from fastmcp import Client
from fastmcp.client.transports import StreamableHttpTransport

# Create the transport with your MCP server URL
server_url = "https://mcp.zapier.com/api/mcp/s/ZTM5YzJjNjAtN2Q2MS00NDJjLTllOWUtZmZkMjhhNzg2ZTk5Ojk3OGNiZDdhLWM2ZGYtNGQ4Yy1hNTcxLTQzYzIxMjdmNTRiMA==/mcp"
transport = StreamableHttpTransport(server_url)

# Initialize the client with the transport
client = Client(transport=transport)


async def main():
    # Connection is established here
    print("Connecting to MCP server...")
    async with client:
        print(f"Client connected: {client.is_connected()}")

        # Make MCP calls within the context
        print("Fetching available tools...")
        tools = await client.list_tools()

        print(f"Available tools: {json.dumps([t.name for t in tools], indent=2)}")
        # Tools returned would look like:
        # - name: "gmail_send_email"
        #   description: "Create and send a new email message."
        #   params: ["cc","to","bcc", ...]

        # Example: Call a specific tool with parameters
        print("Calling gmail_send_email...")
        result = await client.call_tool(
            "gmail_send_email",
            {
                "instructions": "Execute the Gmail: Send Email tool with the following parameters",
                "body": "example-string",
                "subject": "example-string",
            },
        )

        # Parse the JSON string from the TextContent and print it nicely formatted
        json_result = json.loads(result[0].text)
        print(
            f"\ngmail_send_email result:\n{json.dumps(json_result, indent=2)}"
        )

    # Connection is closed automatically when exiting the context manager
    print("Example completed")


if __name__ == "__main__":
    asyncio.run(main())
