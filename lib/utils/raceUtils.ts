const computeRaceCategory = (meters: number, kilometers: number): string => {
    if (meters / kilometers >= 50) {
        return 'A';
    }

    if (meters / kilometers >= 25) {
        return 'B';
    }

    if (meters / kilometers < 25) {
        return 'C';
    }
}

export function computeRaceType(climb: any, distance: any): string {
    const category = computeRaceCategory(climb.meters, distance.kilometers);
    let length;
    
    if (!category) {
      return '';
    }

    if (distance.kilometers < 10) {
      length = 'S';
    } 

    if (distance.kilometers > 10 && distance.kilometers < 20) {
      length = 'M';
    } 

    if (distance.kilometers >= 20) {
      length = 'L';
    } 

    if (!category || !length) {
      if (distance.miles > 0) {
        const distanceParts = distance.miles.toString().split('.');

        if (distanceParts.length > 1) {
          return `${distanceParts[0]}.${distanceParts[1].substring(0, 1)} miles`;
        }

        return `${distanceParts[0]} miles`;
      }

      return '';
    }

    return `${category}${length}`;
  }