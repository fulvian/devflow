// Fixed formatting/indentation errors: inconsistent spacing, wrong indentation, 
// missing spaces around operators, typos in property names

interface User {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
}

// Fixed indentation and spacing
function createUser(id: number, name: string, email: string): User {
  return {
    id: id,
    name: name,
    email: email,
    isActive: true  // Fixed property name typo
  };
}

// Fixed inconsistent spacing around operators
function calculateRectangleArea(width: number, height: number): number {
  return width * height;  // Fixed spacing
}

// Fixed indentation
class UserManager {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUserById(id: number): User | undefined {
    return this.users.find(user => user.id === id);
  }

  // Fixed indentation
  getAllUsers(): User[] {
    return this.users;
  }
}

// Test the implementation
const userManager: UserManager = new UserManager();
const user: User = createUser(1, "John Doe", "john@example.com");
userManager.addUser(user);

console.log(userManager.getUserById(1));
console.log(calculateRectangleArea(5, 3));  // Should be 15
