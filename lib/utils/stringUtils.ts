// @TODO: Test Me
export function upperCaseWords(sentence: string): string {
    const sentenceParts = sentence.split(' ').map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()} `);
    let sentenceToReturn = '';

    sentenceParts.map((part) => {
        sentenceToReturn = `${sentenceToReturn}${part}`;

        return sentenceToReturn;
    });

    return sentenceToReturn.trimRight();
};