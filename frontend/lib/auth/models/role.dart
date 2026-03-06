enum Role {
  locuitor,
  vizitator,
  operator,
  admin,
  organizator;

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
      case Role.locuitor:
        return 'Resident';
      case Role.vizitator:
        return 'Visitor';
      case Role.operator:
        return 'Operator';
      case Role.admin:
        return 'Admin';
      case Role.organizator:
        return 'Organizer';
    }
  }
}
