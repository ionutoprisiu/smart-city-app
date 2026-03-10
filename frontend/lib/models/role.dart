enum Role {
  user,
  admin;

  static Role? fromString(String? value) {
    if (value == null) return null;
    try {
      return Role.values.firstWhere(
        (role) => role.name.toLowerCase() == value.toLowerCase(),
      );
    } catch (e) {
      return null;
    }
  }

  String toDisplayString() {
    switch (this) {
      case Role.user:
        return 'User';
      case Role.admin:
        return 'Admin';
    }
  }
}
