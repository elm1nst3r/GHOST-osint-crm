# Test data: Middle-earth

`middle-earth.json` is GHOST's standard test data set: a fictional
investigation themed on *The Lord of the Rings*. Use it to try GHOST out, to
test a change against data that touches every section, or to take
screenshots. Everything in it is made up.

## What's in it

| | |
|---|---|
| **People** | 22: hobbits, the Fellowship, Saruman and his agents, people of Bree and Rohan. Aliases, patronymics ("Gimli son of Glóin"), ages, categories and statuses |
| **Cases** | 4: The One Ring, Isengard Industries, The Fellowship, Scouring of the Shire. Two people have no case |
| **Relationships** | 30 between people (family, friend, enemy, associate, employee, suspect), plus business owners and employees |
| **Locations** | 2 per person on average. Coordinates are **New Zealand filming locations** (Hobbiton is Matamata, Mount Doom is Ngauruhoe), so the map shows real places |
| **Travel** | Frodo's route from Bree to Mount Doom, Merry's into Fangorn, Saruman's trip to the Shire |
| **Businesses** | 4, with an ownership chain: Isengard Industries owns Sackville-Baggins Holdings |
| **Properties** | 5 (Bag End, Orthanc, Meduseld, Barad-dûr, Brandy Hall) |
| **Assets** | 7 (the One Ring, Sting, the mithril shirt, Andúril, the palantír, Bill the Pony, the phial) |
| **Transactions** | 8: gifts, sales, a loan between businesses, a bribe, a seizure. Some with tags |
| **Wireless networks** | 6 at places of interest, linked to people and businesses |
| **OSINT data** | Emails, phones, usernames, websites, an IP address and a document ID |
| **Saved records** | 4 integration records (prison register, interrogation log, town register, court rolls), with OSINT entries taken from them |
| **To-dos** | 5, in different states |

Emails use the reserved `.example` domain, phone numbers the fictional
`555-01xx` range, and the IP address a documentation range (`192.0.2.0/24`).

## Importing it

1. Create an empty project, for example "Middle-earth", and select it.
2. As an admin, go to **Settings → Import / Export**, choose
   `middle-earth.json` and import.

The data lands in the selected project. If a case of the same name already
exists in another project, the imported case gets the project's name added
(`The One Ring (Middle-earth)`), so nothing is mixed into the other project.
To remove the data again, delete the project.

Not covered by the import format yet: crypto wallets, files, and
person-to-business relationships other than owners and employees.

## Changing it

The file is generated: edit `build-middle-earth.mjs` and run

```bash
node test-data/build-middle-earth.mjs
```

Keep it fictional, and keep contact details in the reserved ranges above.
