import urllib.request
import json
import os
import sys
import io

# Force stdout/stderr to UTF-8 to prevent Windows console encoding crashes
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

url = "https://stitch.googleapis.com/mcp"
headers = {
    "X-Goog-Api-Key": "AQ.Ab8RN6LprR5Rij6LJf90gRiNHnuFvY12348JuwdOMHHiaTUauQ",
    "Content-Type": "application/json"
}

def call_mcp(method, params, request_id):
    data = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": request_id
    }
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if "error" in res_data:
                print(f"Error in {method}: {res_data['error']}")
            return res_data
    except Exception as e:
        print(f"HTTP Exception in {method}: {e}")
        return None

def execute_tool(name, arguments, request_id):
    print(f"Executing tool {name} with arguments {arguments}...")
    return call_mcp("tools/call", {"name": name, "arguments": arguments}, request_id)

def main():
    os.makedirs("stitch_data", exist_ok=True)

    # 1. List tools
    print("Listing tools...")
    tools_res = call_mcp("tools/list", {}, 1)
    with open("stitch_data/mcp_tools.json", "w", encoding="utf-8") as f:
        json.dump(tools_res, f, indent=2, ensure_ascii=False)

    tools = []
    if tools_res and "result" in tools_res and "tools" in tools_res["result"]:
        tools = [t["name"] for t in tools_res["result"]["tools"]]
    print("Available tools on server:", tools)

    # 2. List projects
    print("\nListing projects...")
    projects_res = execute_tool("list_projects", {}, 2)
    with open("stitch_data/mcp_projects.json", "w", encoding="utf-8") as f:
        json.dump(projects_res, f, indent=2, ensure_ascii=False)

    # Parse projects
    project_list = []
    if projects_res and "result" in projects_res and "content" in projects_res["result"]:
        for content in projects_res["result"]["content"]:
            if content.get("type") == "text":
                try:
                    data = json.loads(content["text"])
                    if isinstance(data, list):
                        project_list = data
                    elif isinstance(data, dict) and "projects" in data:
                        project_list = data["projects"]
                except Exception as e:
                    print("Failed to parse projects text:", e)

    print(f"Parsed {len(project_list)} projects.")

    # Process each project
    for p in project_list:
        p_id = p.get("name", "").split("/")[-1]
        p_name = p.get("name", "")
        p_display = p.get("title") or p.get("displayName") or p_id
        print(f"\nProcessing project: {p_display} ({p_id})")

        # Save project's designMd if it exists
        design_theme = p.get("designTheme", {})
        design_md_content = design_theme.get("designMd", "")
        if design_md_content:
            md_filename = f"stitch_data/design_context_{p_id}.md"
            with open(md_filename, "w", encoding="utf-8") as f:
                f.write(design_md_content)
            print(f"Saved design markdown to {md_filename}")

        # get_project details
        p_details = execute_tool("get_project", {"name": p_name}, 20)
        with open(f"stitch_data/project_{p_id}_details.json", "w", encoding="utf-8") as f:
            json.dump(p_details, f, indent=2, ensure_ascii=False)

        # list_screens
        p_screens = execute_tool("list_screens", {"projectId": p_id}, 21)
        with open(f"stitch_data/project_{p_id}_screens.json", "w", encoding="utf-8") as f:
            json.dump(p_screens, f, indent=2, ensure_ascii=False)

        # list_design_systems
        p_ds = execute_tool("list_design_systems", {"projectId": p_id}, 22)
        with open(f"stitch_data/project_{p_id}_design_systems.json", "w", encoding="utf-8") as f:
            json.dump(p_ds, f, indent=2, ensure_ascii=False)

        # Get screens list
        screens_list = []
        if p_screens and "result" in p_screens and "content" in p_screens["result"]:
            for content in p_screens["result"]["content"]:
                if content.get("type") == "text":
                    try:
                        s_data = json.loads(content["text"])
                        if isinstance(s_data, list):
                            screens_list = s_data
                        elif isinstance(s_data, dict) and "screens" in s_data:
                            screens_list = s_data["screens"]
                    except Exception as e:
                        print("Failed to parse screens text:", e)

        print(f"Found {len(screens_list)} screens for project {p_id}")
        
        # Download screens (limit to first 10 for performance, or all if small)
        for s in screens_list[:15]:
            s_name = s.get("name", "")
            s_id = s_name.split("/")[-1]
            s_display = s.get("displayName") or s_id
            print(f"Fetching screen details: {s_display} ({s_id})...")
            
            s_details = execute_tool("get_screen", {"name": s_name, "projectId": p_id, "screenId": s_id}, 30)
            if s_details:
                s_filename = f"stitch_data/screen_{p_id}_{s_id}.json"
                with open(s_filename, "w", encoding="utf-8") as f:
                    json.dump(s_details, f, indent=2, ensure_ascii=False)
                print(f"Saved screen details to {s_filename}")

    print("\nExtraction process completed successfully!")

if __name__ == "__main__":
    main()
