git branch -d release
git push origin --delete release
git checkout -b release
rm -rf ./examples
rm -rf ./scripts
rm velociraptor.json
git add -A 
git commit -m "Release prepped"
git push --set-upstream origin release
