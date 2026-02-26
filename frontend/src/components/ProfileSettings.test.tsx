import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProfileSettings } from "@/components/ProfileSettings";

const defaultProps = {
  displayName: "Demo User",
  username: "user",
  onClose: vi.fn(),
  onDisplayNameChange: vi.fn(),
};

function mockProfileApis() {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";

    if (url === "/api/auth/profile" && method === "PATCH") {
      const body = JSON.parse(init?.body as string);
      return new Response(
        JSON.stringify({ id: 1, username: "user", display_name: body.display_name }),
        { status: 200 }
      );
    }

    if (url === "/api/auth/change-password" && method === "POST") {
      const body = JSON.parse(init?.body as string);
      if (body.current_password === "oldpass") {
        return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
      }
      return new Response(
        JSON.stringify({ detail: "Current password is incorrect" }),
        { status: 400 }
      );
    }

    return new Response(JSON.stringify({ detail: "Not found" }), { status: 404 });
  });
}

describe("ProfileSettings", () => {
  beforeEach(() => {
    mockProfileApis();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders profile settings with username", () => {
    render(<ProfileSettings {...defaultProps} />);
    expect(screen.getByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("shows current display name in input", () => {
    render(<ProfileSettings {...defaultProps} />);
    const input = screen.getByLabelText("Display name");
    expect(input).toHaveValue("Demo User");
  });

  it("calls onClose when close button clicked", async () => {
    const onClose = vi.fn();
    render(<ProfileSettings {...defaultProps} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText(/close/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("updates display name", async () => {
    const onDisplayNameChange = vi.fn();
    render(<ProfileSettings {...defaultProps} onDisplayNameChange={onDisplayNameChange} />);

    const input = screen.getByLabelText("Display name");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    await userEvent.click(screen.getByRole("button", { name: /update name/i }));

    expect(await screen.findByText("Display name updated.")).toBeInTheDocument();
    expect(onDisplayNameChange).toHaveBeenCalledWith("New Name");
  });

  it("changes password successfully", async () => {
    render(<ProfileSettings {...defaultProps} />);

    await userEvent.type(screen.getByLabelText("Current password"), "oldpass");
    await userEvent.type(screen.getByLabelText("New password"), "newpass1");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByText("Password changed.")).toBeInTheDocument();
  });

  it("shows error on wrong current password", async () => {
    render(<ProfileSettings {...defaultProps} />);

    await userEvent.type(screen.getByLabelText("Current password"), "wrongpass");
    await userEvent.type(screen.getByLabelText("New password"), "newpass1");
    await userEvent.click(screen.getByRole("button", { name: /change password/i }));

    expect(await screen.findByText("Current password is incorrect")).toBeInTheDocument();
  });
});
