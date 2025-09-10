/**
 * Test file with deliberate errors for MCP Synthetic debugging
 */

interface User {
  id: string;
  name: string;
  email?: string;
}

class UserService {
  private users: User[] = [];
  
  addUser(user: User): void {
    // Error 1: Missing null check
    if (user.id.length > 0) {
      this.users.push(user);
    }
  }
  
  getUser(id: string): User {
    // Error 2: Potential undefined return
    return this.users.find(u => u.id === id);
  }
  
  getUserEmail(id: string): string {
    const user = this.getUser(id);
    // Error 3: Accessing optional property without check
    return user.email.toLowerCase();
  }
  
  processUsers(): void {
    // Error 4: forEach with potential null/undefined
    this.users.forEach(user => {
      console.log(user.name.toUpperCase());
    });
  }
}

export { UserService };