enum AttractionCategory {
  museum,
  church,
  square,
  monument,
  fortress,
  park,
  restaurant,
  cafe,
  shop,
  theater,
  library,
  hotel,
  other;

  static AttractionCategory fromString(String? value) {
    if (value == null) return AttractionCategory.other;
    try {
      return AttractionCategory.values.firstWhere(
        (c) => c.name.toLowerCase() == value.toLowerCase(),
      );
    } catch (_) {
      return AttractionCategory.other;
    }
  }

  String get label {
    return switch (this) {
      museum => 'Museum',
      church => 'Church',
      square => 'Square',
      monument => 'Monument',
      fortress => 'Fortress',
      park => 'Park',
      restaurant => 'Restaurant',
      cafe => 'Cafe',
      shop => 'Shop',
      theater => 'Theater',
      library => 'Library',
      hotel => 'Hotel',
      other => 'Other',
    };
  }

  String get icon {
    return switch (this) {
      museum => '🏛️',
      church => '⛪',
      square => '🏙️',
      monument => '🗿',
      fortress => '🏰',
      park => '🌳',
      restaurant => '🍽️',
      cafe => '☕',
      shop => '🛍️',
      theater => '🎭',
      library => '📚',
      hotel => '🏨',
      other => '📍',
    };
  }
}

class Attraction {
  final int id;
  final String name;
  final String description;
  final double latitude;
  final double longitude;
  final String city;
  final AttractionCategory category;
  final String? imageUrl;
  final int estimatedVisitTime;
  final bool isActive;

  Attraction({
    required this.id,
    required this.name,
    required this.description,
    required this.latitude,
    required this.longitude,
    required this.city,
    required this.category,
    this.imageUrl,
    required this.estimatedVisitTime,
    required this.isActive,
  });

  factory Attraction.fromJson(Map<String, dynamic> json) {
    return Attraction(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      city: json['city'] ?? '',
      category: AttractionCategory.fromString(json['category']?.toString()),
      imageUrl: json['imageUrl'],
      estimatedVisitTime: json['estimatedVisitTime'] ?? 30,
      isActive: json['isActive'] ?? true,
    );
  }
}
